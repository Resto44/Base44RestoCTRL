-- ============================================================
-- Customer ERP Module — Production-Ready Schema
-- Date: 2026-06-17
-- Tables: customers (enhanced), customer_notes, customer_credit_sales
-- Views:  v_customer_summary, v_customer_aging, v_collection_dashboard
-- ============================================================

-- ── 1. ENHANCE customers TABLE ────────────────────────────────────────────
-- Add missing columns for full ERP functionality
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS branch          TEXT,
  ADD COLUMN IF NOT EXISTS credit_limit    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vip_tier        TEXT DEFAULT 'standard'
                             CHECK (vip_tier IN ('standard','silver','gold','platinum','vip')),
  ADD COLUMN IF NOT EXISTS tags            TEXT[],
  ADD COLUMN IF NOT EXISTS ranking_score   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_transaction_date DATE,
  ADD COLUMN IF NOT EXISTS total_credit_sales    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_collected       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_balance   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS created_by      TEXT;   -- already exists in some envs, safe with IF NOT EXISTS

-- ── 2. customer_notes TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  branch        TEXT,
  note          TEXT NOT NULL,
  note_type     TEXT DEFAULT 'general'
                  CHECK (note_type IN ('general','collection','complaint','promise','vip','other')),
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. customer_credit_sales TABLE ───────────────────────────────────────
-- Tracks individual credit sales (separate from debt_records for granularity)
CREATE TABLE IF NOT EXISTS customer_credit_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL,
  branch          TEXT,
  invoice_number  TEXT,
  sale_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  total_amount    NUMERIC NOT NULL DEFAULT 0,
  paid_amount     NUMERIC DEFAULT 0,
  remaining_amount NUMERIC GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status          TEXT DEFAULT 'open'
                    CHECK (status IN ('open','partial','paid','overdue','written_off')),
  description     TEXT,
  notes           TEXT,
  debt_record_id  UUID REFERENCES debt_records(id) ON DELETE SET NULL,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Triggers for updated_date ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_date = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customer_notes') THEN
    CREATE TRIGGER trg_customer_notes
      BEFORE UPDATE ON customer_notes
      FOR EACH ROW EXECUTE FUNCTION update_updated_date();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customer_credit_sales') THEN
    CREATE TRIGGER trg_customer_credit_sales
      BEFORE UPDATE ON customer_credit_sales
      FOR EACH ROW EXECUTE FUNCTION update_updated_date();
  END IF;
END $$;

-- ── 5. RLS Policies ──────────────────────────────────────────────────────
ALTER TABLE customer_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credit_sales ENABLE ROW LEVEL SECURITY;

-- customers: owner manages all their records
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='customers_owner_all') THEN
    CREATE POLICY customers_owner_all ON customers FOR ALL
      USING (created_by = (auth.jwt() ->> 'email'))
      WITH CHECK (created_by = (auth.jwt() ->> 'email'));
  END IF;
END $$;

-- customer_notes: owner manages all
CREATE POLICY IF NOT EXISTS "customer_notes_owner_all" ON customer_notes FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

-- customer_credit_sales: owner manages all
CREATE POLICY IF NOT EXISTS "customer_credit_sales_owner_all" ON customer_credit_sales FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

-- ── 6. Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_branch         ON customers(branch);
CREATE INDEX IF NOT EXISTS idx_customers_created_by     ON customers(created_by);
CREATE INDEX IF NOT EXISTS idx_customers_vip_tier       ON customers(vip_tier);
CREATE INDEX IF NOT EXISTS idx_customers_outstanding    ON customers(outstanding_balance);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer  ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_branch    ON customer_notes(branch);
CREATE INDEX IF NOT EXISTS idx_ccs_customer_id          ON customer_credit_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_ccs_branch               ON customer_credit_sales(branch);
CREATE INDEX IF NOT EXISTS idx_ccs_sale_date            ON customer_credit_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_ccs_status               ON customer_credit_sales(status);
CREATE INDEX IF NOT EXISTS idx_ccs_created_by           ON customer_credit_sales(created_by);

-- ── 7. VIEWS ─────────────────────────────────────────────────────────────

-- v_customer_summary: aggregated customer data from debt_records + collections
CREATE OR REPLACE VIEW v_customer_summary AS
SELECT
  dr.party_name                          AS customer_name,
  dr.party_phone                         AS phone,
  dr.branch,
  dr.created_by,
  COUNT(DISTINCT dr.id)                  AS credit_sale_count,
  COALESCE(SUM(dr.total_amount), 0)      AS total_credit_sales,
  COALESCE(SUM(dr.paid_amount), 0)       AS total_collected,
  COALESCE(SUM(dr.remaining_amount), 0)  AS outstanding_balance,
  MAX(dr.date)                           AS last_transaction_date,
  COUNT(CASE WHEN dr.status = 'overdue' THEN 1 END) AS overdue_count,
  COUNT(CASE WHEN dr.status IN ('open','partial','overdue') THEN 1 END) AS open_count
FROM debt_records dr
WHERE dr.party_type = 'customer'
GROUP BY dr.party_name, dr.party_phone, dr.branch, dr.created_by;

-- v_customer_aging: aging buckets (0-30, 31-60, 61-90, 90+ days)
CREATE OR REPLACE VIEW v_customer_aging AS
SELECT
  dr.party_name                          AS customer_name,
  dr.party_phone                         AS phone,
  dr.branch,
  dr.created_by,
  COALESCE(SUM(CASE WHEN (CURRENT_DATE - COALESCE(dr.due_date, dr.date)) <= 30
    THEN dr.remaining_amount ELSE 0 END), 0)  AS bucket_0_30,
  COALESCE(SUM(CASE WHEN (CURRENT_DATE - COALESCE(dr.due_date, dr.date)) BETWEEN 31 AND 60
    THEN dr.remaining_amount ELSE 0 END), 0)  AS bucket_31_60,
  COALESCE(SUM(CASE WHEN (CURRENT_DATE - COALESCE(dr.due_date, dr.date)) BETWEEN 61 AND 90
    THEN dr.remaining_amount ELSE 0 END), 0)  AS bucket_61_90,
  COALESCE(SUM(CASE WHEN (CURRENT_DATE - COALESCE(dr.due_date, dr.date)) > 90
    THEN dr.remaining_amount ELSE 0 END), 0)  AS bucket_over_90,
  COALESCE(SUM(dr.remaining_amount), 0)       AS total_outstanding,
  MAX(CURRENT_DATE - COALESCE(dr.due_date, dr.date)) AS max_days_overdue
FROM debt_records dr
WHERE dr.party_type = 'customer'
  AND dr.status IN ('open', 'partial', 'overdue')
  AND dr.remaining_amount > 0
GROUP BY dr.party_name, dr.party_phone, dr.branch, dr.created_by;

-- v_collection_dashboard: daily/weekly/monthly KPIs
CREATE OR REPLACE VIEW v_collection_dashboard AS
SELECT
  cc.created_by,
  cc.branch,
  COALESCE(SUM(CASE WHEN cc.date = CURRENT_DATE THEN cc.amount ELSE 0 END), 0)                              AS collected_today,
  COALESCE(SUM(CASE WHEN cc.date >= date_trunc('week', CURRENT_DATE) THEN cc.amount ELSE 0 END), 0)         AS collected_this_week,
  COALESCE(SUM(CASE WHEN cc.date >= date_trunc('month', CURRENT_DATE) THEN cc.amount ELSE 0 END), 0)        AS collected_this_month,
  COALESCE(SUM(cc.amount), 0)                                                                                AS collected_all_time,
  COUNT(DISTINCT cc.customer_name)                                                                           AS unique_customers_collected,
  COUNT(CASE WHEN cc.date = CURRENT_DATE THEN 1 END)                                                        AS collections_today_count
FROM customer_collections cc
GROUP BY cc.created_by, cc.branch;
