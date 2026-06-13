-- ============================================================
-- ERP Finance Module — Database Schema
-- Tables: customer_collections, supplier_invoices, supplier_payments, cash_register_entries, pos_reconciliation
-- ============================================================

-- 1. CUSTOMER COLLECTIONS
CREATE TABLE IF NOT EXISTS customer_collections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  branch        TEXT NOT NULL,
  debt_id       UUID REFERENCES debt_records(id) ON DELETE SET NULL,
  customer_name TEXT,
  amount        NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash', -- cash, network, bank_transfer, cheque
  notes         TEXT,
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SUPPLIER INVOICES
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  branch         TEXT NOT NULL,
  supplier_id    UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name  TEXT,
  invoice_number TEXT,
  total_amount   NUMERIC NOT NULL DEFAULT 0,
  paid_amount    NUMERIC DEFAULT 0,
  status         TEXT DEFAULT 'pending', -- pending, partial, paid
  notes          TEXT,
  created_by     TEXT,
  created_date   TIMESTAMPTZ DEFAULT NOW(),
  updated_date   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SUPPLIER PAYMENTS
CREATE TABLE IF NOT EXISTS supplier_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  branch         TEXT NOT NULL,
  supplier_id    UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name  TEXT,
  amount         NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash', -- cash, network, bank_transfer, cheque
  notes          TEXT,
  created_by     TEXT,
  created_date   TIMESTAMPTZ DEFAULT NOW(),
  updated_date   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CASH REGISTER ENTRIES
CREATE TABLE IF NOT EXISTS cash_register_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  branch          TEXT NOT NULL,
  opening_cash    NUMERIC DEFAULT 0,
  actual_closing  NUMERIC DEFAULT 0,
  expected_closing NUMERIC DEFAULT 0,
  difference      NUMERIC DEFAULT 0,
  notes           TEXT,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, branch)
);

-- 5. POS RECONCILIATION
CREATE TABLE IF NOT EXISTS pos_reconciliation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  branch          TEXT NOT NULL,
  device_id       TEXT, -- from network_accounts
  expected_amount NUMERIC DEFAULT 0,
  actual_amount   NUMERIC DEFAULT 0,
  difference      NUMERIC DEFAULT 0,
  notes           TEXT,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  updated_date    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, branch, device_id)
);

-- ── Triggers for updated_date ─────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_customer_collections BEFORE UPDATE ON customer_collections FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_supplier_invoices BEFORE UPDATE ON supplier_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_supplier_payments BEFORE UPDATE ON supplier_payments FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_cash_register_entries BEFORE UPDATE ON cash_register_entries FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE OR REPLACE TRIGGER trg_pos_reconciliation BEFORE UPDATE ON pos_reconciliation FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- ── RLS POLICIES ──────────────────────────────────────────────────────────

-- Helper to enable RLS
ALTER TABLE customer_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_reconciliation ENABLE ROW LEVEL SECURITY;

-- Owner Policies (Manage all their own data)
CREATE POLICY "Customer Collections: owner manage all" ON customer_collections FOR ALL USING (created_by = (auth.jwt() ->> 'email')) WITH CHECK (created_by = (auth.jwt() ->> 'email'));
CREATE POLICY "Supplier Invoices: owner manage all" ON supplier_invoices FOR ALL USING (created_by = (auth.jwt() ->> 'email')) WITH CHECK (created_by = (auth.jwt() ->> 'email'));
CREATE POLICY "Supplier Payments: owner manage all" ON supplier_payments FOR ALL USING (created_by = (auth.jwt() ->> 'email')) WITH CHECK (created_by = (auth.jwt() ->> 'email'));
CREATE POLICY "Cash Register: owner manage all" ON cash_register_entries FOR ALL USING (created_by = (auth.jwt() ->> 'email')) WITH CHECK (created_by = (auth.jwt() ->> 'email'));
CREATE POLICY "POS Reconciliation: owner manage all" ON pos_reconciliation FOR ALL USING (created_by = (auth.jwt() ->> 'email')) WITH CHECK (created_by = (auth.jwt() ->> 'email'));

-- Staff Policies (View branch data)
CREATE POLICY "Customer Collections: staff view branch" ON customer_collections FOR SELECT USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Supplier Invoices: staff view branch" ON supplier_invoices FOR SELECT USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Supplier Payments: staff view branch" ON supplier_payments FOR SELECT USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Cash Register: staff view branch" ON cash_register_entries FOR SELECT USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));
CREATE POLICY "POS Reconciliation: staff view branch" ON pos_reconciliation FOR SELECT USING (branch = (SELECT branch FROM profiles WHERE id = auth.uid()));

-- ── Indexes for Performance ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customer_collections_date ON customer_collections(date);
CREATE INDEX IF NOT EXISTS idx_customer_collections_branch ON customer_collections(branch);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_date ON supplier_invoices(date);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_branch ON supplier_invoices(branch);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(date);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_branch ON supplier_payments(branch);
CREATE INDEX IF NOT EXISTS idx_cash_register_date ON cash_register_entries(date);
CREATE INDEX IF NOT EXISTS idx_pos_recon_date ON pos_reconciliation(date);
