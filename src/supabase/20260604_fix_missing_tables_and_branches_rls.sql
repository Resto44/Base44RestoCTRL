-- ============================================================
-- Migration: Fix missing tables + branches RLS
-- Date: 2026-06-04
-- Issues fixed:
--   1. wallet_transactions table missing (404 on sale create)
--   2. settlement_records table missing (404 on sale create)
--   3. subscriptions table missing (404 on page load)
--   4. branches table has RLS enabled but zero policies (blocks all reads)
-- ============================================================

-- ── 1. Create wallet_transactions if missing ──────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE,
  type           TEXT,
  direction      TEXT,
  wallet         TEXT,
  branch         TEXT,
  amount         NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  description    TEXT,
  reference_id   TEXT,
  auto_generated BOOLEAN DEFAULT FALSE,
  recorded_by    TEXT,
  created_by     TEXT,
  created_date   TIMESTAMPTZ DEFAULT NOW(),
  updated_date   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Create settlement_records if missing ───────────────────────────────
CREATE TABLE IF NOT EXISTS settlement_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_type             TEXT NOT NULL,
  date                  DATE,
  amount                NUMERIC DEFAULT 0,
  branch                TEXT,
  network_account_id    TEXT,
  submitted_by          TEXT,
  submitted_by_name     TEXT,
  proof_url             TEXT,
  proof_uploaded_at     TEXT,
  notes                 TEXT,
  status                TEXT DEFAULT 'pending',
  verified_by           TEXT,
  verified_at           TEXT,
  reviewed_by           TEXT,
  reviewed_at           TEXT,
  rejection_reason      TEXT,
  reference_id          TEXT,
  parent_settlement_id  TEXT,
  is_locked             BOOLEAN DEFAULT FALSE,
  ocr_vendor            TEXT,
  created_by            TEXT,
  created_date          TIMESTAMPTZ DEFAULT NOW(),
  updated_date          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Create subscriptions if missing ───────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_key                TEXT,
  plan                   TEXT DEFAULT 'starter',
  subscription_status    TEXT DEFAULT 'trial',
  current_period_end     DATE,
  trial_end              DATE,
  payment_provider       TEXT DEFAULT 'none',
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  monthly_price          NUMERIC DEFAULT 0,
  max_restaurants        NUMERIC DEFAULT 1,
  max_branches           NUMERIC DEFAULT 3,
  max_employees          NUMERIC DEFAULT 20,
  max_ocr_scans          NUMERIC DEFAULT 100,
  max_pdf_exports        NUMERIC DEFAULT 50,
  used_ocr_scans         NUMERIC DEFAULT 0,
  used_pdf_exports       NUMERIC DEFAULT 0,
  created_by             TEXT,
  created_date           TIMESTAMPTZ DEFAULT NOW(),
  updated_date           TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Fix branches RLS — add owner read/write policy ────────────────────
-- branches has RLS enabled but NO policies → all authenticated users blocked
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Branches: owner manage" ON public.branches;
CREATE POLICY "Branches: owner manage" ON public.branches
FOR ALL
TO authenticated
USING (
  restaurant_id IN (
    SELECT r.id FROM public.restaurants r
    WHERE r.org_id = (auth.jwt() ->> 'email')
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT r.id FROM public.restaurants r
    WHERE r.org_id = (auth.jwt() ->> 'email')
  )
);

DROP POLICY IF EXISTS "Branches: staff view" ON public.branches;
CREATE POLICY "Branches: staff view" ON public.branches
FOR SELECT
TO authenticated
USING (
  restaurant_id IN (
    SELECT p.restaurant_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.restaurant_id IS NOT NULL
  )
);

-- ── 5. Add RLS to new tables ──────────────────────────────────────────────
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "WalletTx: owner manage" ON public.wallet_transactions;
CREATE POLICY "WalletTx: owner manage" ON public.wallet_transactions
FOR ALL
TO authenticated
USING (created_by = (auth.jwt() ->> 'email'))
WITH CHECK (created_by = (auth.jwt() ->> 'email') OR (auth.uid() IS NOT NULL));

ALTER TABLE public.settlement_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SettlementRecords: owner manage" ON public.settlement_records;
CREATE POLICY "SettlementRecords: owner manage" ON public.settlement_records
FOR ALL
TO authenticated
USING (created_by = (auth.jwt() ->> 'email'))
WITH CHECK (created_by = (auth.jwt() ->> 'email') OR (auth.uid() IS NOT NULL));

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscriptions: owner manage" ON public.subscriptions;
CREATE POLICY "Subscriptions: owner manage" ON public.subscriptions
FOR ALL
TO authenticated
USING (org_key = (auth.jwt() ->> 'email'))
WITH CHECK (org_key = (auth.jwt() ->> 'email') OR (auth.uid() IS NOT NULL));
