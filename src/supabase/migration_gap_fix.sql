-- ============================================================
-- RestoCtrl — Gap Fix Migration
-- Generated: 2026-06-04
-- Source of truth: RestoCtrl-openapi-spec2.json
-- ============================================================

-- ── 1. CREATE purchases TABLE (MISSING) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch          TEXT,
  date            DATE,
  product_id      TEXT,
  product_name    TEXT,
  qty             NUMERIC DEFAULT 0,
  current_price   NUMERIC,
  used_price      NUMERIC,
  category        TEXT,
  notes           TEXT,
  receipt_url     TEXT,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Purchases: owner manage all" ON purchases;
CREATE POLICY "Purchases: owner manage all" ON purchases
  FOR ALL
  USING (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Purchases: manager manage branch" ON purchases;
CREATE POLICY "Purchases: manager manage branch" ON purchases
  FOR ALL
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid() AND role = 'manager'))
  WITH CHECK (branch = (SELECT branch FROM profiles WHERE id = auth.uid() AND role = 'manager'));

DROP POLICY IF EXISTS "Purchases: staff view branch" ON purchases;
CREATE POLICY "Purchases: staff view branch" ON purchases
  FOR SELECT
  USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- ── 2. ADD MISSING COLUMNS TO daily_sales ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='restaurant_network_account_id') THEN
    ALTER TABLE daily_sales ADD COLUMN restaurant_network_account_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='driver_cash') THEN
    ALTER TABLE daily_sales ADD COLUMN driver_cash NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='driver_network') THEN
    ALTER TABLE daily_sales ADD COLUMN driver_network NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='driver_name') THEN
    ALTER TABLE daily_sales ADD COLUMN driver_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='driver_employee_id') THEN
    ALTER TABLE daily_sales ADD COLUMN driver_employee_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='driver_network_account_id') THEN
    ALTER TABLE daily_sales ADD COLUMN driver_network_account_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='drivers_json') THEN
    ALTER TABLE daily_sales ADD COLUMN drivers_json TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='network_account_id') THEN
    ALTER TABLE daily_sales ADD COLUMN network_account_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='notes') THEN
    ALTER TABLE daily_sales ADD COLUMN notes TEXT;
  END IF;
  -- Also ensure proof_url exists (used by SalesForm for receipt upload)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='proof_url') THEN
    ALTER TABLE daily_sales ADD COLUMN proof_url TEXT;
  END IF;
  -- auto_generated and reference_id used by WalletTransaction creation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='auto_generated') THEN
    ALTER TABLE daily_sales ADD COLUMN auto_generated BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_sales' AND column_name='reference_id') THEN
    ALTER TABLE daily_sales ADD COLUMN reference_id TEXT;
  END IF;
END $$;

-- ── 3. ADD MISSING COLUMNS TO suppliers ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='contact_name') THEN
    ALTER TABLE suppliers ADD COLUMN contact_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='category') THEN
    ALTER TABLE suppliers ADD COLUMN category TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='contract_start') THEN
    ALTER TABLE suppliers ADD COLUMN contract_start DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='contract_end') THEN
    ALTER TABLE suppliers ADD COLUMN contract_end DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='payment_terms') THEN
    ALTER TABLE suppliers ADD COLUMN payment_terms TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='credit_limit') THEN
    ALTER TABLE suppliers ADD COLUMN credit_limit NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='contract_notes') THEN
    ALTER TABLE suppliers ADD COLUMN contract_notes TEXT;
  END IF;
END $$;

-- ── 4. FIX suppliers RLS — add created_by policy so ownerFilter works ─────
-- The Suppliers.jsx page passes { created_by: user.email } via ownerFilter
-- but the existing policy only checks restaurant_id.
-- Add a fallback policy that allows access by created_by.
DROP POLICY IF EXISTS "Suppliers: owner manage by email" ON suppliers;
CREATE POLICY "Suppliers: owner manage by email" ON suppliers
  FOR ALL
  USING (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ── 5. FIX customers RLS — add created_by policy ──────────────────────────
-- customers table RLS only checks restaurant_id; add created_by fallback
DROP POLICY IF EXISTS "Customers: owner manage by email" ON customers;
CREATE POLICY "Customers: owner manage by email" ON customers
  FOR ALL
  USING (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ── 6. ADD updated_date to payments (missing) ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='updated_date') THEN
    ALTER TABLE payments ADD COLUMN updated_date TIMESTAMPTZ DEFAULT NOW();
  END IF;
  -- branch column needed for RLS and filtering
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='branch') THEN
    ALTER TABLE payments ADD COLUMN branch TEXT;
  END IF;
END $$;

-- ── 7. FIX payments RLS — add created_by policy ───────────────────────────
-- Current policy requires order_id join; add direct created_by policy
DROP POLICY IF EXISTS "Payments: owner manage by email" ON payments;
CREATE POLICY "Payments: owner manage by email" ON payments
  FOR ALL
  USING (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (created_by = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ── 8. ADD category column to products if missing ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category') THEN
    ALTER TABLE products ADD COLUMN category TEXT;
  END IF;
END $$;

-- ── 9. Ensure purchases has an index on created_by and branch ─────────────
CREATE INDEX IF NOT EXISTS purchases_created_by_idx ON purchases(created_by);
CREATE INDEX IF NOT EXISTS purchases_branch_idx ON purchases(branch);
CREATE INDEX IF NOT EXISTS purchases_date_idx ON purchases(date DESC);
