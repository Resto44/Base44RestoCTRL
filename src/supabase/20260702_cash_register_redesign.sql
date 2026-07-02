-- ============================================================
-- CASH REGISTER REDESIGN — Full Integration Migration
-- Date: 2026-07-02
-- Description: Creates DailyCashSettlement, CashShortage,
--   OwnerCashInjection, and CashMovement tables.
--   Adds Supabase triggers to auto-post cash movements
--   from Sales, Purchases, Expenses, and Payments.
-- ============================================================

-- ── 1. DAILY CASH SETTLEMENT ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_cash_settlements (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                      DATE NOT NULL DEFAULT CURRENT_DATE,
  branch                    TEXT NOT NULL,
  restaurant_id             UUID REFERENCES public.restaurants(id),
  created_by                TEXT,                          -- owner email
  -- Opening
  opening_cash              NUMERIC DEFAULT 0,
  -- Cash IN
  cash_sales                NUMERIC DEFAULT 0,
  customer_debt_collection  NUMERIC DEFAULT 0,
  owner_injection           NUMERIC DEFAULT 0,
  cash_transfer_in          NUMERIC DEFAULT 0,
  supplier_refunds          NUMERIC DEFAULT 0,
  -- Cash OUT
  cash_purchases            NUMERIC DEFAULT 0,
  cash_expenses             NUMERIC DEFAULT 0,
  supplier_payments         NUMERIC DEFAULT 0,
  cash_refunds_out          NUMERIC DEFAULT 0,
  cash_transfer_out         NUMERIC DEFAULT 0,
  -- Computed
  expected_closing_cash     NUMERIC DEFAULT 0,
  cash_counted              NUMERIC DEFAULT 0,
  difference                NUMERIC DEFAULT 0,
  shortage                  NUMERIC DEFAULT 0,
  overage                   NUMERIC DEFAULT 0,
  -- Status & Approval
  status                    TEXT DEFAULT 'Draft'
                              CHECK (status IN ('Draft','Submitted','Approved','Rejected')),
  notes                     TEXT,
  manager                   TEXT,
  manager_name              TEXT,
  approved_by               TEXT,
  approved_at               TIMESTAMPTZ,
  submitted_at              TIMESTAMPTZ,
  shortage_record_id        UUID,
  -- Timestamps
  created_date              TIMESTAMPTZ DEFAULT NOW(),
  updated_date              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, branch, COALESCE(restaurant_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

-- ── 2. CASH SHORTAGE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_shortages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  branch            TEXT NOT NULL,
  restaurant_id     UUID REFERENCES public.restaurants(id),
  created_by        TEXT,
  settlement_id     UUID REFERENCES public.daily_cash_settlements(id),
  expected_amount   NUMERIC DEFAULT 0,
  actual_amount     NUMERIC DEFAULT 0,
  shortage_amount   NUMERIC DEFAULT 0,
  overage_amount    NUMERIC DEFAULT 0,
  type              TEXT DEFAULT 'Shortage'
                      CHECK (type IN ('Shortage','Overage')),
  status            TEXT DEFAULT 'Pending'
                      CHECK (status IN ('Pending','Investigating','Approved','Resolved')),
  manager_notes     TEXT,
  owner_notes       TEXT,
  reported_by       TEXT,
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,
  resolution        TEXT CHECK (resolution IN (
                      'Owner Injection','Salary Deduction','Write Off',
                      'Recovered','Other', NULL)),
  injection_id      UUID,
  created_date      TIMESTAMPTZ DEFAULT NOW(),
  updated_date      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. OWNER CASH INJECTION ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_cash_injections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  branch                TEXT NOT NULL,
  restaurant_id         UUID REFERENCES public.restaurants(id),
  created_by            TEXT,
  created_by_name       TEXT,
  amount                NUMERIC NOT NULL DEFAULT 0,
  reason                TEXT,
  notes                 TEXT,
  approval_status       TEXT DEFAULT 'Approved'
                          CHECK (approval_status IN ('Pending','Approved','Rejected')),
  approved_by           TEXT,
  approved_at           TIMESTAMPTZ,
  wallet_transaction_id UUID,
  settlement_id         UUID REFERENCES public.daily_cash_settlements(id),
  shortage_id           UUID REFERENCES public.cash_shortages(id),
  created_date          TIMESTAMPTZ DEFAULT NOW(),
  updated_date          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. CASH MOVEMENT LEDGER ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  branch            TEXT NOT NULL,
  restaurant_id     UUID REFERENCES public.restaurants(id),
  created_by        TEXT,
  direction         TEXT NOT NULL CHECK (direction IN ('in','out')),
  amount            NUMERIC NOT NULL DEFAULT 0,
  movement_type     TEXT NOT NULL CHECK (movement_type IN (
                      'cash_sale','customer_debt_collection','supplier_refund',
                      'owner_injection','cash_transfer_in','cash_deposit',
                      'cash_purchase','cash_expense','supplier_payment',
                      'customer_refund','cash_transfer_out','cash_withdrawal',
                      'salary_advance','shortage_adjustment','overage_adjustment'
                    )),
  source_module     TEXT NOT NULL CHECK (source_module IN (
                      'Sales','Purchases','Expenses','Treasury',
                      'SupplierPayments','CustomerPayments',
                      'OwnerCashInjection','DailyCashSettlement','Payroll'
                    )),
  source_record_id  TEXT,
  description       TEXT,
  posted_by         TEXT,
  posted_by_name    TEXT,
  posted_at         TIMESTAMPTZ DEFAULT NOW(),
  settlement_id     UUID REFERENCES public.daily_cash_settlements(id),
  is_reversed       BOOLEAN DEFAULT FALSE,
  reversal_of       UUID REFERENCES public.cash_movements(id),
  created_date      TIMESTAMPTZ DEFAULT NOW(),
  updated_date      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. UPDATED_DATE TRIGGERS ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_date_generic()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_date = NOW(); RETURN NEW; END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_daily_cash_settlements_upd') THEN
    CREATE TRIGGER trg_daily_cash_settlements_upd
      BEFORE UPDATE ON public.daily_cash_settlements
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_generic();
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cash_shortages_upd') THEN
    CREATE TRIGGER trg_cash_shortages_upd
      BEFORE UPDATE ON public.cash_shortages
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_generic();
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_owner_cash_injections_upd') THEN
    CREATE TRIGGER trg_owner_cash_injections_upd
      BEFORE UPDATE ON public.owner_cash_injections
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_generic();
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cash_movements_upd') THEN
    CREATE TRIGGER trg_cash_movements_upd
      BEFORE UPDATE ON public.cash_movements
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_generic();
  END IF;
END $$;

-- ── 6. ROW LEVEL SECURITY ────────────────────────────────────────────────────
ALTER TABLE public.daily_cash_settlements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_shortages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_cash_injections    ENABLE ROW LEVEL SECURITY;

-- Owner: full access to own data
CREATE POLICY "DailyCashSettlement: owner all" ON public.daily_cash_settlements
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "CashShortage: owner all" ON public.cash_shortages
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "OwnerCashInjection: owner all" ON public.owner_cash_injections
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

CREATE POLICY "CashMovement: owner all" ON public.cash_movements
  FOR ALL USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));

-- Manager: view and create for own branch
CREATE POLICY "DailyCashSettlement: manager branch" ON public.daily_cash_settlements
  FOR ALL USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "CashShortage: manager branch" ON public.cash_shortages
  FOR ALL USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "OwnerCashInjection: manager view branch" ON public.owner_cash_injections
  FOR SELECT USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "CashMovement: manager branch" ON public.cash_movements
  FOR SELECT USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

-- ── 7. PERFORMANCE INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_cash_settlements_date_branch
  ON public.daily_cash_settlements(date, branch);
CREATE INDEX IF NOT EXISTS idx_daily_cash_settlements_restaurant
  ON public.daily_cash_settlements(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_cash_shortages_date_branch
  ON public.cash_shortages(date, branch);
CREATE INDEX IF NOT EXISTS idx_cash_shortages_status
  ON public.cash_shortages(status);
CREATE INDEX IF NOT EXISTS idx_owner_cash_injections_date_branch
  ON public.owner_cash_injections(date, branch);
CREATE INDEX IF NOT EXISTS idx_cash_movements_date_branch
  ON public.cash_movements(date, branch);
CREATE INDEX IF NOT EXISTS idx_cash_movements_source
  ON public.cash_movements(source_module, source_record_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_settlement
  ON public.cash_movements(settlement_id);

-- ── 8. AUTO-COMPUTE EXPECTED CLOSING CASH FUNCTION ───────────────────────────
-- Called by the frontend service after any cash movement is posted.
-- Recomputes expected_closing_cash, difference, shortage, overage.
CREATE OR REPLACE FUNCTION public.recompute_settlement(p_settlement_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  s public.daily_cash_settlements%ROWTYPE;
  v_expected NUMERIC;
  v_diff     NUMERIC;
BEGIN
  SELECT * INTO s FROM public.daily_cash_settlements WHERE id = p_settlement_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_expected := COALESCE(s.opening_cash, 0)
              + COALESCE(s.cash_sales, 0)
              + COALESCE(s.customer_debt_collection, 0)
              + COALESCE(s.owner_injection, 0)
              + COALESCE(s.cash_transfer_in, 0)
              + COALESCE(s.supplier_refunds, 0)
              - COALESCE(s.cash_purchases, 0)
              - COALESCE(s.cash_expenses, 0)
              - COALESCE(s.supplier_payments, 0)
              - COALESCE(s.cash_refunds_out, 0)
              - COALESCE(s.cash_transfer_out, 0);

  v_diff := COALESCE(s.cash_counted, 0) - v_expected;

  UPDATE public.daily_cash_settlements SET
    expected_closing_cash = v_expected,
    difference            = v_diff,
    shortage              = CASE WHEN v_diff < 0 THEN ABS(v_diff) ELSE 0 END,
    overage               = CASE WHEN v_diff > 0 THEN v_diff ELSE 0 END,
    updated_date          = NOW()
  WHERE id = p_settlement_id;
END;
$$;

-- ── 9. HELPER: GET OR CREATE TODAY'S SETTLEMENT ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_settlement(
  p_date        DATE,
  p_branch      TEXT,
  p_created_by  TEXT,
  p_restaurant_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_prev_closing NUMERIC DEFAULT 0;
BEGIN
  -- Try to find existing
  SELECT id INTO v_id
  FROM public.daily_cash_settlements
  WHERE date = p_date
    AND branch = p_branch
    AND (created_by = p_created_by OR p_created_by IS NULL)
  LIMIT 1;

  IF FOUND THEN
    RETURN v_id;
  END IF;

  -- Get previous day's closing as opening for today
  SELECT COALESCE(expected_closing_cash, 0) INTO v_prev_closing
  FROM public.daily_cash_settlements
  WHERE branch = p_branch
    AND (created_by = p_created_by OR p_created_by IS NULL)
    AND date < p_date
    AND status IN ('Approved', 'Submitted')
  ORDER BY date DESC
  LIMIT 1;

  INSERT INTO public.daily_cash_settlements
    (date, branch, restaurant_id, created_by, opening_cash, status)
  VALUES
    (p_date, p_branch, p_restaurant_id, p_created_by, v_prev_closing, 'Draft')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 10. TRIGGER: AUTO-POST CASH MOVEMENTS & RECALCULATE SETTLEMENT ───────────
CREATE OR REPLACE FUNCTION public.trg_auto_cash_movement_and_recalculate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settlement_id UUID;
  v_movement_type TEXT;
  v_direction     TEXT;
  v_amount        NUMERIC;
  v_source_module TEXT;
  v_source_record_id TEXT;
  v_description   TEXT;
  v_created_by    TEXT;
  v_restaurant_id UUID;
  v_branch        TEXT;
  v_date          DATE;
  v_old_amount    NUMERIC DEFAULT 0;
  v_old_movement_id UUID;
BEGIN
  -- Determine common fields
  IF TG_TABLE_NAME = 'daily_sales' THEN
    v_date := NEW.date;
    v_branch := NEW.branch;
    v_created_by := NEW.created_by;
    v_restaurant_id := NEW.restaurant_id;
    v_source_module := 'Sales';
    v_source_record_id := NEW.id::TEXT;
    v_description := 'Cash Sale';
    v_movement_type := 'cash_sale';
    v_direction := 'in';
    v_amount := COALESCE(NEW.restaurant_cash, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.restaurant_cash, 0); END IF;
  ELSIF TG_TABLE_NAME = 'purchases' THEN
    v_date := NEW.purchase_date;
    v_branch := NEW.branch;
    v_created_by := NEW.created_by;
    v_restaurant_id := NEW.restaurant_id;
    v_source_module := 'Purchases';
    v_source_record_id := NEW.id::TEXT;
    v_description := 'Cash Purchase';
    v_movement_type := 'cash_purchase';
    v_direction := 'out';
    v_amount := COALESCE(NEW.cash_amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.cash_amount, 0); END IF;
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    v_date := NEW.expense_date;
    v_branch := NEW.branch;
    v_created_by := NEW.created_by;
    v_restaurant_id := NEW.restaurant_id;
    v_source_module := 'Expenses';
    v_source_record_id := NEW.id::TEXT;
    v_description := 'Cash Expense';
    v_movement_type := 'cash_expense';
    v_direction := 'out';
    v_amount := COALESCE(NEW.cash_amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.cash_amount, 0); END IF;
  ELSIF TG_TABLE_NAME = 'customer_payments' THEN
    v_date := NEW.payment_date;
    v_branch := NEW.branch;
    v_created_by := NEW.created_by;
    v_restaurant_id := NEW.restaurant_id;
    v_source_module := 'CustomerPayments';
    v_source_record_id := NEW.id::TEXT;
    v_description := 'Customer Debt Collection';
    v_movement_type := 'customer_debt_collection';
    v_direction := 'in';
    v_amount := COALESCE(NEW.cash_amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.cash_amount, 0); END IF;
  ELSIF TG_TABLE_NAME = 'supplier_payments' THEN
    v_date := NEW.payment_date;
    v_branch := NEW.branch;
    v_created_by := NEW.created_by;
    v_restaurant_id := NEW.restaurant_id;
    v_source_module := 'SupplierPayments';
    v_source_record_id := NEW.id::TEXT;
    v_description := 'Supplier Payment';
    v_movement_type := 'supplier_payment';
    v_direction := 'out';
    v_amount := COALESCE(NEW.cash_amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.cash_amount, 0); END IF;
  ELSIF TG_TABLE_NAME = 'wallet_transactions' THEN
    v_date := NEW.transaction_date;
    v_branch := NEW.branch;
    v_created_by := NEW.created_by;
    v_restaurant_id := NEW.restaurant_id;
    v_source_module := 'Treasury';
    v_source_record_id := NEW.id::TEXT;
    IF NEW.transaction_type = 'deposit' AND NEW.payment_method = 'Cash' THEN
      v_description := 'Cash Deposit';
      v_movement_type := 'cash_deposit';
      v_direction := 'in';
      v_amount := COALESCE(NEW.amount, 0);
    ELSIF NEW.transaction_type = 'withdrawal' AND NEW.payment_method = 'Cash' THEN
      v_description := 'Cash Withdrawal';
      v_movement_type := 'cash_withdrawal';
      v_direction := 'out';
      v_amount := COALESCE(NEW.amount, 0);
    ELSE
      RETURN NEW; -- Not a cash deposit/withdrawal
    END IF;
    IF TG_OP = 'UPDATE' THEN
      -- Need to handle old cash amount for wallet transactions carefully
      -- For simplicity, we'll assume a full reversal if type/method changes
      -- or if amount changes significantly. More robust logic might be needed.
      IF OLD.transaction_type = 'deposit' AND OLD.payment_method = 'Cash' THEN
        v_old_amount := COALESCE(OLD.amount, 0);
      ELSIF OLD.transaction_type = 'withdrawal' AND OLD.payment_method = 'Cash' THEN
        v_old_amount := COALESCE(OLD.amount, 0);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'owner_cash_injections' THEN
    v_date := NEW.date;
    v_branch := NEW.branch;
    v_created_by := NEW.created_by;
    v_restaurant_id := NEW.restaurant_id;
    v_source_module := 'OwnerCashInjection';
    v_source_record_id := NEW.id::TEXT;
    v_description := 'Owner Cash Injection';
    v_movement_type := 'owner_injection';
    v_direction := 'in';
    v_amount := COALESCE(NEW.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); END IF;
  ELSE
    RETURN NEW; -- Should not happen with proper trigger setup
  END IF;

  -- If amount is 0 or not a cash transaction, do nothing
  IF v_amount = 0 AND v_old_amount = 0 THEN
    RETURN NEW;
  END IF;

  -- Get or create today's settlement
  v_settlement_id := public.get_or_create_settlement(v_date, v_branch, v_created_by, v_restaurant_id);

  -- Handle UPDATE operations: reverse old movement and then create new one
  IF TG_OP = 'UPDATE' AND v_old_amount > 0 THEN
    -- Find and mark the old movement as reversed
    SELECT id INTO v_old_movement_id
    FROM public.cash_movements
    WHERE source_module = v_source_module
      AND source_record_id = OLD.id::TEXT
      AND movement_type = v_movement_type
      AND is_reversed = FALSE
    ORDER BY posted_at DESC LIMIT 1;

    IF FOUND THEN
      UPDATE public.cash_movements SET is_reversed = TRUE, updated_date = NOW()
      WHERE id = v_old_movement_id;

      -- Update the settlement by subtracting the old amount
      IF v_direction = 'in' THEN
        EXECUTE FORMAT('UPDATE public.daily_cash_settlements SET %I = %I - %L WHERE id = %L',
          v_movement_type, v_movement_type, v_old_amount, v_settlement_id);
      ELSE
        EXECUTE FORMAT('UPDATE public.daily_cash_settlements SET %I = %I - %L WHERE id = %L',
          v_movement_type, v_movement_type, v_old_amount, v_settlement_id);
      END IF;
      PERFORM public.recompute_settlement(v_settlement_id);
    END IF;
  END IF;

  -- Create new cash movement if amount > 0
  IF v_amount > 0 THEN
    INSERT INTO public.cash_movements (
      date, branch, restaurant_id, created_by, direction, amount, movement_type,
      source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
    ) VALUES (
      v_date, v_branch, v_restaurant_id, v_created_by, v_direction, v_amount, v_movement_type,
      v_source_module, v_source_record_id, v_description, v_created_by, v_created_by, v_settlement_id
    );

    -- Update the corresponding field in daily_cash_settlements
    IF v_direction = 'in' THEN
      EXECUTE FORMAT('UPDATE public.daily_cash_settlements SET %I = %I + %L WHERE id = %L',
        v_movement_type, v_movement_type, v_amount, v_settlement_id);
    ELSE
      EXECUTE FORMAT('UPDATE public.daily_cash_settlements SET %I = %I + %L WHERE id = %L',
        v_movement_type, v_movement_type, v_amount, v_settlement_id);
    END IF;
    PERFORM public.recompute_settlement(v_settlement_id);
  END IF;

  -- Handle DELETE operations: reverse the movement
  IF TG_OP = 'DELETE' THEN
    -- Find and mark the old movement as reversed
    SELECT id INTO v_old_movement_id
    FROM public.cash_movements
    WHERE source_module = v_source_module
      AND source_record_id = OLD.id::TEXT
      AND movement_type = v_movement_type
      AND is_reversed = FALSE
    ORDER BY posted_at DESC LIMIT 1;

    IF FOUND THEN
      UPDATE public.cash_movements SET is_reversed = TRUE, updated_date = NOW()
      WHERE id = v_old_movement_id;

      -- Update the settlement by subtracting the old amount
      IF v_direction = 'in' THEN
        EXECUTE FORMAT('UPDATE public.daily_cash_settlements SET %I = %I - %L WHERE id = %L',
          v_movement_type, v_movement_type, v_old_amount, v_settlement_id);
      ELSE
        EXECUTE FORMAT('UPDATE public.daily_cash_settlements SET %I = %I - %L WHERE id = %L',
          v_movement_type, v_movement_type, v_old_amount, v_settlement_id);
      END IF;
      PERFORM public.recompute_settlement(v_settlement_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers for auto-posting and recalculation
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_daily_sales_cash_movement') THEN
    CREATE TRIGGER trg_daily_sales_cash_movement
      AFTER INSERT OR UPDATE OR DELETE ON public.daily_sales
      FOR EACH ROW EXECUTE FUNCTION public.trg_auto_cash_movement_and_recalculate();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_purchases_cash_movement') THEN
    CREATE TRIGGER trg_purchases_cash_movement
      AFTER INSERT OR UPDATE OR DELETE ON public.purchases
      FOR EACH ROW EXECUTE FUNCTION public.trg_auto_cash_movement_and_recalculate();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_expenses_cash_movement') THEN
    CREATE TRIGGER trg_expenses_cash_movement
      AFTER INSERT OR UPDATE OR DELETE ON public.expenses
      FOR EACH ROW EXECUTE FUNCTION public.trg_auto_cash_movement_and_recalculate();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customer_payments_cash_movement') THEN
    CREATE TRIGGER trg_customer_payments_cash_movement
      AFTER INSERT OR UPDATE OR DELETE ON public.customer_payments
      FOR EACH ROW EXECUTE FUNCTION public.trg_auto_cash_movement_and_recalculate();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_supplier_payments_cash_movement') THEN
    CREATE TRIGGER trg_supplier_payments_cash_movement
      AFTER INSERT OR UPDATE OR DELETE ON public.supplier_payments
      FOR EACH ROW EXECUTE FUNCTION public.trg_auto_cash_movement_and_recalculate();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wallet_transactions_cash_movement') THEN
    CREATE TRIGGER trg_wallet_transactions_cash_movement
      AFTER INSERT OR UPDATE OR DELETE ON public.wallet_transactions
      FOR EACH ROW EXECUTE FUNCTION public.trg_auto_cash_movement_and_recalculate();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_owner_cash_injections_post_movement') THEN
    CREATE TRIGGER trg_owner_cash_injections_post_movement
      AFTER INSERT OR UPDATE OR DELETE ON public.owner_cash_injections
      FOR EACH ROW EXECUTE FUNCTION public.trg_auto_cash_movement_and_recalculate();
  END IF;
END $$;

-- ── 11. TRIGGER: AUTO-UPDATE OPENING CASH FOR NEXT DAY ───────────────────────
-- When a daily_cash_settlement is approved, update the next day's opening_cash.
CREATE OR REPLACE FUNCTION public.trg_update_next_day_opening_cash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'Approved' AND NEW.expected_closing_cash IS NOT NULL THEN
    INSERT INTO public.daily_cash_settlements
      (date, branch, restaurant_id, created_by, opening_cash, status)
    VALUES
      (NEW.date + INTERVAL '1 day', NEW.branch, NEW.restaurant_id, NEW.created_by, NEW.expected_closing_cash, 'Draft')
    ON CONFLICT (date, branch, COALESCE(restaurant_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
      opening_cash = EXCLUDED.opening_cash,
      updated_date = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_daily_cash_settlements_update_next_day') THEN
    CREATE TRIGGER trg_daily_cash_settlements_update_next_day
      AFTER UPDATE ON public.daily_cash_settlements
      FOR EACH ROW
      WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Approved')
      EXECUTE FUNCTION public.trg_update_next_day_opening_cash();
  END IF;
END $$;

-- ── 12. INITIAL DATA MIGRATION (BACKFILL) ────────────────────────────────────
-- This section will be executed once to backfill historical data.
-- It should be run manually or as part of a controlled migration process.

-- Function to backfill cash movements and settlements for a given date range
CREATE OR REPLACE FUNCTION public.backfill_cash_register_data(
  start_date DATE,
  end_date DATE
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_date DATE;
  r RECORD;
  v_settlement_id UUID;
  v_opening_cash NUMERIC;
BEGIN
  current_date := start_date;

  WHILE current_date <= end_date LOOP
    RAISE NOTICE 'Processing date: %', current_date;

    FOR r IN
      SELECT DISTINCT branch, created_by, restaurant_id
      FROM (
        SELECT date, branch, created_by, restaurant_id FROM public.daily_sales WHERE date = current_date
        UNION ALL
        SELECT purchase_date AS date, branch, created_by, restaurant_id FROM public.purchases WHERE purchase_date = current_date
        UNION ALL
        SELECT expense_date AS date, branch, created_by, restaurant_id FROM public.expenses WHERE expense_date = current_date
        UNION ALL
        SELECT payment_date AS date, branch, created_by, restaurant_id FROM public.customer_payments WHERE payment_date = current_date
        UNION ALL
        SELECT payment_date AS date, branch, created_by, restaurant_id FROM public.supplier_payments WHERE payment_date = current_date
        UNION ALL
        SELECT transaction_date AS date, branch, created_by, restaurant_id FROM public.wallet_transactions WHERE transaction_date = current_date AND payment_method = 'Cash'
        UNION ALL
        SELECT date, branch, created_by, restaurant_id FROM public.owner_cash_injections WHERE date = current_date
      ) AS daily_activity
    LOOP
      -- Get or create settlement for the current day and branch
      v_settlement_id := public.get_or_create_settlement(current_date, r.branch, r.created_by, r.restaurant_id);

      -- Process daily_sales (cash sales)
      FOR r_sale IN SELECT * FROM public.daily_sales WHERE date = current_date AND branch = r.branch AND created_by = r.created_by AND restaurant_id = r.restaurant_id AND restaurant_cash > 0 LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount, movement_type,
          source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_sale.date, r_sale.branch, r_sale.restaurant_id, r_sale.created_by, 'in', r_sale.restaurant_cash, 'cash_sale',
          'Sales', r_sale.id::TEXT, 'Cash Sale', r_sale.created_by, r_sale.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;
        UPDATE public.daily_cash_settlements SET cash_sales = cash_sales + r_sale.restaurant_cash WHERE id = v_settlement_id;
      END LOOP;

      -- Process purchases (cash purchases)
      FOR r_purchase IN SELECT * FROM public.purchases WHERE purchase_date = current_date AND branch = r.branch AND created_by = r.created_by AND restaurant_id = r.restaurant_id AND cash_amount > 0 LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount, movement_type,
          source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_purchase.purchase_date, r_purchase.branch, r_purchase.restaurant_id, r_purchase.created_by, 'out', r_purchase.cash_amount, 'cash_purchase',
          'Purchases', r_purchase.id::TEXT, 'Cash Purchase', r_purchase.created_by, r_purchase.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;
        UPDATE public.daily_cash_settlements SET cash_purchases = cash_purchases + r_purchase.cash_amount WHERE id = v_settlement_id;
      END LOOP;

      -- Process expenses (cash expenses)
      FOR r_expense IN SELECT * FROM public.expenses WHERE expense_date = current_date AND branch = r.branch AND created_by = r.created_by AND restaurant_id = r.restaurant_id AND cash_amount > 0 LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount, movement_type,
          source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_expense.expense_date, r_expense.branch, r_expense.restaurant_id, r_expense.created_by, 'out', r_expense.cash_amount, 'cash_expense',
          'Expenses', r_expense.id::TEXT, 'Cash Expense', r_expense.created_by, r_expense.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;
        UPDATE public.daily_cash_settlements SET cash_expenses = cash_expenses + r_expense.cash_amount WHERE id = v_settlement_id;
      END LOOP;

      -- Process customer_payments (cash payments)
      FOR r_cust_pay IN SELECT * FROM public.customer_payments WHERE payment_date = current_date AND branch = r.branch AND created_by = r.created_by AND restaurant_id = r.restaurant_id AND cash_amount > 0 LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount, movement_type,
          source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_cust_pay.payment_date, r_cust_pay.branch, r_cust_pay.restaurant_id, r_cust_pay.created_by, 'in', r_cust_pay.cash_amount, 'customer_debt_collection',
          'CustomerPayments', r_cust_pay.id::TEXT, 'Customer Debt Collection', r_cust_pay.created_by, r_cust_pay.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;
        UPDATE public.daily_cash_settlements SET customer_debt_collection = customer_debt_collection + r_cust_pay.cash_amount WHERE id = v_settlement_id;
      END LOOP;

      -- Process supplier_payments (cash payments)
      FOR r_supp_pay IN SELECT * FROM public.supplier_payments WHERE payment_date = current_date AND branch = r.branch AND created_by = r.created_by AND restaurant_id = r.restaurant_id AND cash_amount > 0 LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount, movement_type,
          source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_supp_pay.payment_date, r_supp_pay.branch, r_supp_pay.restaurant_id, r_supp_pay.created_by, 'out', r_supp_pay.cash_amount, 'supplier_payment',
          'SupplierPayments', r_supp_pay.id::TEXT, 'Supplier Payment', r_supp_pay.created_by, r_supp_pay.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;
        UPDATE public.daily_cash_settlements SET supplier_payments = supplier_payments + r_supp_pay.cash_amount WHERE id = v_settlement_id;
      END LOOP;

      -- Process wallet_transactions (cash deposits/withdrawals)
      FOR r_wallet IN SELECT * FROM public.wallet_transactions WHERE transaction_date = current_date AND branch = r.branch AND created_by = r.created_by AND restaurant_id = r.restaurant_id AND payment_method = 'Cash' AND amount > 0 LOOP
        IF r_wallet.transaction_type = 'deposit' THEN
          INSERT INTO public.cash_movements (
            date, branch, restaurant_id, created_by, direction, amount, movement_type,
            source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
          ) VALUES (
            r_wallet.transaction_date, r_wallet.branch, r_wallet.restaurant_id, r_wallet.created_by, 'in', r_wallet.amount, 'cash_deposit',
            'Treasury', r_wallet.id::TEXT, 'Cash Deposit', r_wallet.created_by, r_wallet.created_by, v_settlement_id
          ) ON CONFLICT DO NOTHING;
          UPDATE public.daily_cash_settlements SET cash_transfer_in = cash_transfer_in + r_wallet.amount WHERE id = v_settlement_id;
        ELSIF r_wallet.transaction_type = 'withdrawal' THEN
          INSERT INTO public.cash_movements (
            date, branch, restaurant_id, created_by, direction, amount, movement_type,
            source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
          ) VALUES (
            r_wallet.transaction_date, r_wallet.branch, r_wallet.restaurant_id, r_wallet.created_by, 'out', r_wallet.amount, 'cash_withdrawal',
            'Treasury', r_wallet.id::TEXT, 'Cash Withdrawal', r_wallet.created_by, r_wallet.created_by, v_settlement_id
          ) ON CONFLICT DO NOTHING;
          UPDATE public.daily_cash_settlements SET cash_transfer_out = cash_transfer_out + r_wallet.amount WHERE id = v_settlement_id;
        END IF;
      END LOOP;

      -- Process owner_cash_injections
      FOR r_injection IN SELECT * FROM public.owner_cash_injections WHERE date = current_date AND branch = r.branch AND created_by = r.created_by AND restaurant_id = r.restaurant_id AND amount > 0 LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount, movement_type,
          source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_injection.date, r_injection.branch, r_injection.restaurant_id, r_injection.created_by, 'in', r_injection.amount, 'owner_injection',
          'OwnerCashInjection', r_injection.id::TEXT, 'Owner Cash Injection', r_injection.created_by, r_injection.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;
        UPDATE public.daily_cash_settlements SET owner_injection = owner_injection + r_injection.amount WHERE id = v_settlement_id;
      END LOOP;

      -- Recompute settlement after all movements for the day/branch are processed
      PERFORM public.recompute_settlement(v_settlement_id);

    END LOOP;

    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END;
$$;

-- ── 13. RLS FOR WALLET_TRANSACTIONS (IF NOT ALREADY THERE) ───────────────────
-- Ensure wallet_transactions has RLS for manager branch access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'WalletTransaction: manager branch') THEN
    ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "WalletTransaction: manager branch" ON public.wallet_transactions
      FOR SELECT USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ── 14. RLS FOR CUSTOMER_PAYMENTS (IF NOT ALREADY THERE) ───────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'CustomerPayment: manager branch') THEN
    ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "CustomerPayment: manager branch" ON public.customer_payments
      FOR SELECT USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ── 15. RLS FOR SUPPLIER_PAYMENTS (IF NOT ALREADY THERE) ───────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'SupplierPayment: manager branch') THEN
    ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "SupplierPayment: manager branch" ON public.supplier_payments
      FOR SELECT USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ── 16. RLS FOR PURCHASES (IF NOT ALREADY THERE) ───────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Purchase: manager branch') THEN
    ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Purchase: manager branch" ON public.purchases
      FOR SELECT USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ── 17. RLS FOR EXPENSES (IF NOT ALREADY THERE) ───────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Expense: manager branch') THEN
    ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Expense: manager branch" ON public.expenses
      FOR SELECT USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ── 18. RLS FOR DAILY_SALES (IF NOT ALREADY THERE) ───────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'DailySale: manager branch') THEN
    ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "DailySale: manager branch" ON public.daily_sales
      FOR SELECT USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;
