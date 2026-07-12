-- ============================================================
-- ERP SaaS Upgrade Migration
-- Date: 2026-07-12
-- Description: Adds business_type to restaurants, creates
--              supplier_invites table, and extends role support
-- ============================================================

-- 1. Add business_type column to restaurants table
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'restaurant';

-- Allowed values: restaurant, cafe, retail, warehouse, factory,
--                 pharmacy, clinic, wholesale, services, other

-- 2. Create supplier_invites table
CREATE TABLE IF NOT EXISTS supplier_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Supplier info (self-registered)
  supplier_name   TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT NOT NULL,
  phone           TEXT,
  products        TEXT,           -- comma-separated product categories
  notes           TEXT,

  -- Tenant linkage
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  owner_email     TEXT,

  -- Invite / approval flow
  invite_token    TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),

  -- After approval, the supplier's user_id is stored here
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  approved_by     TEXT,           -- owner email who approved
  rejection_reason TEXT
);

-- 3. Indexes for supplier_invites
CREATE INDEX IF NOT EXISTS idx_supplier_invites_restaurant_id
  ON supplier_invites(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invites_email
  ON supplier_invites(email);
CREATE INDEX IF NOT EXISTS idx_supplier_invites_status
  ON supplier_invites(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invites_invite_token
  ON supplier_invites(invite_token);

-- 4. Row-Level Security for supplier_invites
ALTER TABLE supplier_invites ENABLE ROW LEVEL SECURITY;

-- Owner can see all supplier invites for their restaurant
CREATE POLICY "owner_supplier_invites_all" ON supplier_invites
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE created_by = auth.uid()::text
    )
  );

-- Supplier can see their own invite by email
CREATE POLICY "supplier_own_invite" ON supplier_invites
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Anyone can insert a new supplier invite (self-registration)
CREATE POLICY "supplier_self_register" ON supplier_invites
  FOR INSERT
  WITH CHECK (true);

-- 5. Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_invites_updated_at
  BEFORE UPDATE ON supplier_invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Add business_type index
CREATE INDEX IF NOT EXISTS idx_restaurants_business_type
  ON restaurants(business_type);

-- 7. Add supplier role to users table (if role column exists)
-- The users table uses a 'role' TEXT column; supplier is a new valid value.
-- No schema change needed — just ensure app accepts 'supplier' as a role.

-- Done.
