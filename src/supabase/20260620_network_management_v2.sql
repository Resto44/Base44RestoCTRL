-- ═══════════════════════════════════════════════════════════════════════════
-- NETWORK MANAGEMENT V2  —  Clean rebuild from scratch
-- Date: 2026-06-20
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. CLEAN UP OLD TABLES (if they exist) ──────────────────────────────────
DROP TABLE IF EXISTS network_transfers      CASCADE;
DROP TABLE IF EXISTS network_pos_devices    CASCADE;
DROP TABLE IF EXISTS network_reconciliations CASCADE;

-- ── 2. REBUILD network_accounts ─────────────────────────────────────────────
-- Drop and recreate to ensure clean schema
ALTER TABLE IF EXISTS network_accounts
  DROP COLUMN IF EXISTS employee_id,
  DROP COLUMN IF EXISTS manager_id,
  DROP COLUMN IF EXISTS driver_id,
  DROP COLUMN IF EXISTS customer_id,
  DROP COLUMN IF EXISTS supplier_id,
  DROP COLUMN IF EXISTS order_id,
  DROP COLUMN IF EXISTS purchase_order_id,
  DROP COLUMN IF EXISTS invoice_id,
  DROP COLUMN IF EXISTS debt_id,
  DROP COLUMN IF EXISTS settlement_id,
  DROP COLUMN IF EXISTS wallet_id,
  DROP COLUMN IF EXISTS account_id,
  DROP COLUMN IF EXISTS category_id,
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS recipe_id,
  DROP COLUMN IF EXISTS task_id,
  DROP COLUMN IF EXISTS shift_id,
  DROP COLUMN IF EXISTS attendance_id,
  DROP COLUMN IF EXISTS invite_id,
  DROP COLUMN IF EXISTS batch_id,
  DROP COLUMN IF EXISTS document_id,
  DROP COLUMN IF EXISTS policy_id,
  DROP COLUMN IF EXISTS run_id,
  DROP COLUMN IF EXISTS subscription_id,
  DROP COLUMN IF EXISTS ticket_id,
  DROP COLUMN IF EXISTS owner_id,
  DROP COLUMN IF EXISTS user_id,
  DROP COLUMN IF EXISTS profile_id;

-- Ensure required columns exist on network_accounts
DO $$
BEGIN
  -- branch_id (required FK to restaurants.id as text — matches existing pattern)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='network_accounts' AND column_name='branch_id') THEN
    ALTER TABLE network_accounts ADD COLUMN branch_id TEXT NOT NULL DEFAULT '';
  END IF;
  -- network_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='network_accounts' AND column_name='network_name') THEN
    ALTER TABLE network_accounts ADD COLUMN network_name TEXT;
  END IF;
  -- provider
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='network_accounts' AND column_name='network_provider') THEN
    ALTER TABLE network_accounts ADD COLUMN network_provider TEXT;
  END IF;
  -- iban
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='network_accounts' AND column_name='iban') THEN
    ALTER TABLE network_accounts ADD COLUMN iban TEXT;
  END IF;
  -- is_active already exists (boolean)
END $$;

-- ── 3. network_pos_devices ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS network_pos_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   TEXT NOT NULL,
  branch_id       TEXT NOT NULL,
  network_account_id UUID,
  device_name     TEXT NOT NULL,
  device_serial   TEXT,
  provider        TEXT,
  status          TEXT DEFAULT 'active',  -- active | inactive | maintenance
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. network_transfers ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS network_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   TEXT NOT NULL,
  from_account_id UUID NOT NULL,
  to_account_id   UUID NOT NULL,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT DEFAULT 'SAR',
  transfer_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT DEFAULT 'completed',  -- pending | completed | failed
  reference       TEXT,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. network_reconciliations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS network_reconciliations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   TEXT NOT NULL,
  branch_id       TEXT NOT NULL,
  network_account_id UUID,
  recon_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_amount NUMERIC(14,2) DEFAULT 0,
  actual_amount   NUMERIC(14,2) DEFAULT 0,
  variance        NUMERIC(14,2) GENERATED ALWAYS AS (actual_amount - expected_amount) STORED,
  status          TEXT DEFAULT 'pending',  -- pending | matched | variance
  notes           TEXT,
  settled_by      TEXT,
  settled_at      TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. INDEXES ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_network_accounts_restaurant ON network_accounts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_network_accounts_branch    ON network_accounts(branch_id);
CREATE INDEX IF NOT EXISTS idx_network_accounts_status    ON network_accounts(status);

CREATE INDEX IF NOT EXISTS idx_network_pos_restaurant     ON network_pos_devices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_network_pos_branch         ON network_pos_devices(branch_id);
CREATE INDEX IF NOT EXISTS idx_network_pos_account        ON network_pos_devices(network_account_id);

CREATE INDEX IF NOT EXISTS idx_network_transfers_restaurant ON network_transfers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_network_transfers_from       ON network_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_network_transfers_to         ON network_transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_network_transfers_date       ON network_transfers(transfer_date);

CREATE INDEX IF NOT EXISTS idx_network_recon_restaurant   ON network_reconciliations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_network_recon_branch       ON network_reconciliations(branch_id);
CREATE INDEX IF NOT EXISTS idx_network_recon_date         ON network_reconciliations(recon_date);

-- ── 7. UPDATED_AT TRIGGERS ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_network_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_network_pos_updated    ON network_pos_devices;
DROP TRIGGER IF EXISTS trg_network_trans_updated  ON network_transfers;
DROP TRIGGER IF EXISTS trg_network_recon_updated  ON network_reconciliations;

CREATE TRIGGER trg_network_pos_updated
  BEFORE UPDATE ON network_pos_devices
  FOR EACH ROW EXECUTE FUNCTION update_network_updated_at();

CREATE TRIGGER trg_network_trans_updated
  BEFORE UPDATE ON network_transfers
  FOR EACH ROW EXECUTE FUNCTION update_network_updated_at();

CREATE TRIGGER trg_network_recon_updated
  BEFORE UPDATE ON network_reconciliations
  FOR EACH ROW EXECUTE FUNCTION update_network_updated_at();

-- ── 8. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE network_pos_devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_transfers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_reconciliations ENABLE ROW LEVEL SECURITY;

-- Owner: full access scoped to their restaurants
CREATE POLICY "net_pos_owner" ON network_pos_devices FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "net_transfer_owner" ON network_transfers FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

CREATE POLICY "net_recon_owner" ON network_reconciliations FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE org_id = (auth.jwt() ->> 'email')));

-- Manager: view own branch data
CREATE POLICY "net_pos_manager" ON network_pos_devices FOR SELECT
  USING (branch_id = (SELECT branch FROM profiles WHERE id = auth.uid()));

CREATE POLICY "net_transfer_manager" ON network_transfers FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "net_recon_manager" ON network_reconciliations FOR SELECT
  USING (branch_id = (SELECT branch FROM profiles WHERE id = auth.uid()));
