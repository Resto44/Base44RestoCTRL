-- ============================================================
-- Unified Debt Management Module
-- Date: 2026-06-18
-- Features:
--   1. Auto-invoice numbering (DBT-YYYYMMDD-XXXX)
--   2. debt_invoices table (auto-created on debt save)
--   3. debt_receipts table (auto-created on payment)
--   4. whatsapp_outbound_queue table (for WhatsApp delivery)
--   5. Enhanced debt_payments (receipt_number, party_phone)
--   6. Enhanced debt_records (invoice_auto_number, customer_phone)
-- ============================================================

-- ── 1. Add auto-invoice fields to debt_records ────────────────────────────
ALTER TABLE debt_records
  ADD COLUMN IF NOT EXISTS invoice_auto_number  TEXT,
  ADD COLUMN IF NOT EXISTS customer_id          UUID,
  ADD COLUMN IF NOT EXISTS whatsapp_sent        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_status      TEXT DEFAULT 'pending';

-- ── 2. Add receipt fields to debt_payments ───────────────────────────────
ALTER TABLE debt_payments
  ADD COLUMN IF NOT EXISTS receipt_number       TEXT,
  ADD COLUMN IF NOT EXISTS party_name           TEXT,
  ADD COLUMN IF NOT EXISTS party_phone          TEXT,
  ADD COLUMN IF NOT EXISTS restaurant_id        UUID,
  ADD COLUMN IF NOT EXISTS branch               TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_sent        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_status      TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS recorded_by_name     TEXT;

-- ── 3. debt_invoices table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debt_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_record_id    UUID REFERENCES debt_records(id) ON DELETE CASCADE,
  invoice_number    TEXT NOT NULL,
  invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  party_name        TEXT NOT NULL,
  party_phone       TEXT,
  party_type        TEXT,
  branch            TEXT,
  total_amount      NUMERIC NOT NULL DEFAULT 0,
  paid_amount       NUMERIC DEFAULT 0,
  remaining_amount  NUMERIC DEFAULT 0,
  description       TEXT,
  notes             TEXT,
  due_date          DATE,
  status            TEXT DEFAULT 'open',
  pdf_url           TEXT,
  whatsapp_sent     BOOLEAN DEFAULT FALSE,
  whatsapp_status   TEXT DEFAULT 'pending',
  whatsapp_sent_at  TIMESTAMPTZ,
  restaurant_id     UUID,
  created_by        TEXT,
  created_date      TIMESTAMPTZ DEFAULT NOW(),
  updated_date      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. debt_receipts table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debt_receipts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_payment_id   UUID REFERENCES debt_payments(id) ON DELETE CASCADE,
  debt_record_id    UUID,
  receipt_number    TEXT NOT NULL,
  receipt_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  party_name        TEXT NOT NULL,
  party_phone       TEXT,
  branch            TEXT,
  amount            NUMERIC NOT NULL DEFAULT 0,
  payment_method    TEXT DEFAULT 'cash',
  invoice_number    TEXT,
  notes             TEXT,
  pdf_url           TEXT,
  whatsapp_sent     BOOLEAN DEFAULT FALSE,
  whatsapp_status   TEXT DEFAULT 'pending',
  whatsapp_sent_at  TIMESTAMPTZ,
  restaurant_id     UUID,
  created_by        TEXT,
  created_date      TIMESTAMPTZ DEFAULT NOW(),
  updated_date      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. whatsapp_outbound_queue table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_outbound_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type      TEXT NOT NULL CHECK (message_type IN ('invoice', 'receipt', 'reminder', 'general')),
  recipient_phone   TEXT NOT NULL,
  recipient_name    TEXT,
  message_body      TEXT,
  pdf_url           TEXT,
  reference_id      UUID,
  reference_type    TEXT,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  attempts          INTEGER DEFAULT 0,
  last_attempt_at   TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  error_message     TEXT,
  restaurant_id     UUID,
  created_by        TEXT,
  created_date      TIMESTAMPTZ DEFAULT NOW(),
  updated_date      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. invoice_sequence table for auto-numbering ─────────────────────────
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID,
  sequence_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  last_sequence   INTEGER DEFAULT 0,
  UNIQUE (restaurant_id, sequence_date)
);

-- ── 7. Function: generate next invoice number ─────────────────────────────
CREATE OR REPLACE FUNCTION generate_debt_invoice_number(p_restaurant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date     TEXT := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  v_seq      INTEGER;
  v_number   TEXT;
BEGIN
  INSERT INTO invoice_sequences (restaurant_id, sequence_date, last_sequence)
  VALUES (p_restaurant_id, CURRENT_DATE, 1)
  ON CONFLICT (restaurant_id, sequence_date)
  DO UPDATE SET last_sequence = invoice_sequences.last_sequence + 1
  RETURNING last_sequence INTO v_seq;

  v_number := 'DBT-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_number;
END;
$$;

-- ── 8. Triggers for updated_date ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_date_col()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_date = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_debt_invoices_updated') THEN
    CREATE TRIGGER trg_debt_invoices_updated
      BEFORE UPDATE ON debt_invoices
      FOR EACH ROW EXECUTE FUNCTION update_updated_date_col();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_debt_receipts_updated') THEN
    CREATE TRIGGER trg_debt_receipts_updated
      BEFORE UPDATE ON debt_receipts
      FOR EACH ROW EXECUTE FUNCTION update_updated_date_col();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_queue_updated') THEN
    CREATE TRIGGER trg_whatsapp_queue_updated
      BEFORE UPDATE ON whatsapp_outbound_queue
      FOR EACH ROW EXECUTE FUNCTION update_updated_date_col();
  END IF;
END $$;

-- ── 9. RLS Policies ───────────────────────────────────────────────────────
ALTER TABLE debt_invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_receipts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_outbound_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences        ENABLE ROW LEVEL SECURITY;

-- debt_invoices: owner manages all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='debt_invoices' AND policyname='debt_invoices_owner_all') THEN
    CREATE POLICY debt_invoices_owner_all ON debt_invoices FOR ALL
      USING (created_by = (auth.jwt() ->> 'email'))
      WITH CHECK (created_by = (auth.jwt() ->> 'email'));
  END IF;
END $$;

-- debt_receipts: owner manages all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='debt_receipts' AND policyname='debt_receipts_owner_all') THEN
    CREATE POLICY debt_receipts_owner_all ON debt_receipts FOR ALL
      USING (created_by = (auth.jwt() ->> 'email'))
      WITH CHECK (created_by = (auth.jwt() ->> 'email'));
  END IF;
END $$;

-- whatsapp_outbound_queue: owner manages all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whatsapp_outbound_queue' AND policyname='whatsapp_queue_owner_all') THEN
    CREATE POLICY whatsapp_queue_owner_all ON whatsapp_outbound_queue FOR ALL
      USING (created_by = (auth.jwt() ->> 'email'))
      WITH CHECK (created_by = (auth.jwt() ->> 'email'));
  END IF;
END $$;

-- invoice_sequences: owner manages all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_sequences' AND policyname='invoice_sequences_owner_all') THEN
    CREATE POLICY invoice_sequences_owner_all ON invoice_sequences FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── 10. Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_debt_invoices_debt_record_id ON debt_invoices(debt_record_id);
CREATE INDEX IF NOT EXISTS idx_debt_invoices_invoice_number ON debt_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_debt_invoices_created_by     ON debt_invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_debt_receipts_debt_payment_id ON debt_receipts(debt_payment_id);
CREATE INDEX IF NOT EXISTS idx_debt_receipts_receipt_number  ON debt_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_debt_receipts_created_by      ON debt_receipts(created_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status         ON whatsapp_outbound_queue(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_created_by     ON whatsapp_outbound_queue(created_by);
CREATE INDEX IF NOT EXISTS idx_debt_records_invoice_auto     ON debt_records(invoice_auto_number);
