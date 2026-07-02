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
                      'owner_injection','cash_transfer_in',
                      'cash_purchase','cash_expense','supplier_payment',
                      'customer_refund','cash_transfer_out',
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
ALTER TABLE public.owner_cash_injections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements           ENABLE ROW LEVEL SECURITY;

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
  FOR ALL USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "CashShortage: manager branch" ON public.cash_shortages
  FOR ALL USING (branch = (SELECT branch FROM public.profiles WHERE id = auth.uid()));

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

-- ── 10. TRIGGER: AUTO-POST CASH SALES FROM DAILY_SALES ───────────────────────
-- When a daily_sales record is inserted/updated with cash > 0,
-- post a CashMovement and update DailyCashSettlement.
CREATE OR REPLACE FUNCTION public.trg_daily_sales_cash_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cash_amount NUMERIC;
  v_settlement_id UUID;
  v_old_cash NUMERIC DEFAULT 0;
BEGIN
  -- Only process cash amounts
  v_cash_amount := COALESCE(NEW.restaurant_cash, 0);
  v_old_cash    := COALESCE(OLD.restaurant_cash, 0);

  IF v_cash_amount = v_old_cash AND TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Reverse old movement if update
  IF TG_OP = 'UPDATE' AND v_old_cash > 0 THEN
    UPDATE public.cash_movements SET is_reversed = TRUE
    WHERE source_module = 'Sales' AND source_record_id = OLD.id::TEXT
      AND movement_type = 'cash_sale' AND is_reversed = FALSE;
  END IF;

  IF v_cash_amount > 0 THEN
    -- Get/create settlement
    v_settlement_id := public.get_or_create_settlement(
      NEW.date::DATE, NEW.branch, NEW.created_by, NEW.restaurant_id
    );

    -- Insert cash movement
    INSERT INTO public.cash_movements
      (date, branch, restaurant_id, created_by, direction, amount,
       movement_type, source_module, source_record_id, description,
       posted_by, settlement_id)
    VALUES
      (NEW.date::DATE, NEW.branch, NEW.restaurant_id, NEW.created_by,
       'in', v_cash_amount, 'cash_sale', 'Sales', NEW.id::TEXT,
       'Cash Sales - ' || NEW.date, NEW.created_by, v_settlement_id);

    -- Update settlement cash_sales total
    UPDATE public.daily_cash_settlements
    SET cash_sales = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.cash_movements
      WHERE settlement_id = v_settlement_id
        AND movement_type = 'cash_sale'
        AND is_reversed = FALSE
    ), updated_date = NOW()
    WHERE id = v_settlement_id;

    -- Recompute expected closing
    PERFORM public.recompute_settlement(v_settlement_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_sales_cash ON public.daily_sales;
CREATE TRIGGER trg_daily_sales_cash
  AFTER INSERT OR UPDATE OF restaurant_cash ON public.daily_sales
  FOR EACH ROW EXECUTE FUNCTION public.trg_daily_sales_cash_post();

-- ── 11. TRIGGER: AUTO-POST CASH EXPENSES ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_expenses_cash_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_amount NUMERIC;
  v_settlement_id UUID;
BEGIN
  -- Only cash expenses
  IF COALESCE(NEW.payment_method, 'cash') != 'cash' THEN RETURN NEW; END IF;
  v_amount := COALESCE(NEW.amount, 0);
  IF v_amount <= 0 THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_movements SET is_reversed = TRUE
    WHERE source_module = 'Expenses' AND source_record_id = OLD.id::TEXT
      AND movement_type = 'cash_expense' AND is_reversed = FALSE;
  END IF;

  v_settlement_id := public.get_or_create_settlement(
    NEW.date::DATE, NEW.branch, NEW.created_by, NULL
  );

  INSERT INTO public.cash_movements
    (date, branch, created_by, direction, amount, movement_type,
     source_module, source_record_id, description, posted_by, settlement_id)
  VALUES
    (NEW.date::DATE, NEW.branch, NEW.created_by, 'out', v_amount,
     'cash_expense', 'Expenses', NEW.id::TEXT,
     COALESCE(NEW.description, NEW.category) || ' (Expense)', NEW.created_by,
     v_settlement_id);

  UPDATE public.daily_cash_settlements
  SET cash_expenses = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.cash_movements
    WHERE settlement_id = v_settlement_id
      AND movement_type = 'cash_expense'
      AND is_reversed = FALSE
  ), updated_date = NOW()
  WHERE id = v_settlement_id;

  PERFORM public.recompute_settlement(v_settlement_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_cash ON public.expenses;
CREATE TRIGGER trg_expenses_cash
  AFTER INSERT OR UPDATE OF amount, payment_method ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.trg_expenses_cash_post();

-- ── 12. TRIGGER: AUTO-POST CASH PURCHASES ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_purchases_cash_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_amount NUMERIC;
  v_settlement_id UUID;
BEGIN
  v_amount := COALESCE(NEW.used_price, NEW.current_price, 0) * COALESCE(NEW.qty, 0);
  IF v_amount <= 0 THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_movements SET is_reversed = TRUE
    WHERE source_module = 'Purchases' AND source_record_id = OLD.id::TEXT
      AND movement_type = 'cash_purchase' AND is_reversed = FALSE;
  END IF;

  v_settlement_id := public.get_or_create_settlement(
    NEW.date::DATE, NEW.branch, NEW.created_by, NULL
  );

  INSERT INTO public.cash_movements
    (date, branch, created_by, direction, amount, movement_type,
     source_module, source_record_id, description, posted_by, settlement_id)
  VALUES
    (NEW.date::DATE, NEW.branch, NEW.created_by, 'out', v_amount,
     'cash_purchase', 'Purchases', NEW.id::TEXT,
     COALESCE(NEW.product_name, 'Purchase') || ' x' || NEW.qty, NEW.created_by,
     v_settlement_id);

  UPDATE public.daily_cash_settlements
  SET cash_purchases = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.cash_movements
    WHERE settlement_id = v_settlement_id
      AND movement_type = 'cash_purchase'
      AND is_reversed = FALSE
  ), updated_date = NOW()
  WHERE id = v_settlement_id;

  PERFORM public.recompute_settlement(v_settlement_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchases_cash ON public.purchases;
CREATE TRIGGER trg_purchases_cash
  AFTER INSERT OR UPDATE OF used_price, current_price, qty ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_purchases_cash_post();

-- ── 13. TRIGGER: AUTO-POST SUPPLIER PAYMENTS ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_supplier_payments_cash_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_amount NUMERIC;
  v_settlement_id UUID;
BEGIN
  IF COALESCE(NEW.payment_method, 'cash') != 'cash' THEN RETURN NEW; END IF;
  v_amount := COALESCE(NEW.amount, 0);
  IF v_amount <= 0 THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_movements SET is_reversed = TRUE
    WHERE source_module = 'SupplierPayments' AND source_record_id = OLD.id::TEXT
      AND movement_type = 'supplier_payment' AND is_reversed = FALSE;
  END IF;

  v_settlement_id := public.get_or_create_settlement(
    NEW.date::DATE, NEW.branch, NEW.created_by, NULL
  );

  INSERT INTO public.cash_movements
    (date, branch, created_by, direction, amount, movement_type,
     source_module, source_record_id, description, posted_by, settlement_id)
  VALUES
    (NEW.date::DATE, NEW.branch, NEW.created_by, 'out', v_amount,
     'supplier_payment', 'SupplierPayments', NEW.id::TEXT,
     'Supplier Payment', NEW.created_by, v_settlement_id);

  UPDATE public.daily_cash_settlements
  SET supplier_payments = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.cash_movements
    WHERE settlement_id = v_settlement_id
      AND movement_type = 'supplier_payment'
      AND is_reversed = FALSE
  ), updated_date = NOW()
  WHERE id = v_settlement_id;

  PERFORM public.recompute_settlement(v_settlement_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_payments_cash ON public.supplier_payments;
CREATE TRIGGER trg_supplier_payments_cash
  AFTER INSERT OR UPDATE OF amount, payment_method ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_supplier_payments_cash_post();

-- ── 14. TRIGGER: AUTO-POST CUSTOMER DEBT COLLECTIONS ────────────────────────
CREATE OR REPLACE FUNCTION public.trg_customer_collections_cash_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_amount NUMERIC;
  v_settlement_id UUID;
BEGIN
  IF COALESCE(NEW.payment_method, 'cash') != 'cash' THEN RETURN NEW; END IF;
  v_amount := COALESCE(NEW.amount, 0);
  IF v_amount <= 0 THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_movements SET is_reversed = TRUE
    WHERE source_module = 'CustomerPayments' AND source_record_id = OLD.id::TEXT
      AND movement_type = 'customer_debt_collection' AND is_reversed = FALSE;
  END IF;

  v_settlement_id := public.get_or_create_settlement(
    NEW.date::DATE, NEW.branch, NEW.created_by, NULL
  );

  INSERT INTO public.cash_movements
    (date, branch, created_by, direction, amount, movement_type,
     source_module, source_record_id, description, posted_by, settlement_id)
  VALUES
    (NEW.date::DATE, NEW.branch, NEW.created_by, 'in', v_amount,
     'customer_debt_collection', 'CustomerPayments', NEW.id::TEXT,
     'Customer Debt Collection (Cash)', NEW.created_by, v_settlement_id);

  UPDATE public.daily_cash_settlements
  SET customer_debt_collection = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.cash_movements
    WHERE settlement_id = v_settlement_id
      AND movement_type = 'customer_debt_collection'
      AND is_reversed = FALSE
  ), updated_date = NOW()
  WHERE id = v_settlement_id;

  PERFORM public.recompute_settlement(v_settlement_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_collections_cash ON public.customer_collections;
CREATE TRIGGER trg_customer_collections_cash
  AFTER INSERT OR UPDATE OF amount, payment_method ON public.customer_collections
  FOR EACH ROW EXECUTE FUNCTION public.trg_customer_collections_cash_post();

-- ── 15. TRIGGER: AUTO-POST OWNER CASH INJECTIONS ────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_owner_injection_cash_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settlement_id UUID;
BEGIN
  IF NEW.amount <= 0 THEN RETURN NEW; END IF;

  v_settlement_id := public.get_or_create_settlement(
    NEW.date::DATE, NEW.branch, NEW.created_by, NEW.restaurant_id
  );

  INSERT INTO public.cash_movements
    (date, branch, restaurant_id, created_by, direction, amount, movement_type,
     source_module, source_record_id, description, posted_by, settlement_id)
  VALUES
    (NEW.date::DATE, NEW.branch, NEW.restaurant_id, NEW.created_by,
     'in', NEW.amount, 'owner_injection', 'OwnerCashInjection', NEW.id::TEXT,
     'Owner Cash Injection: ' || COALESCE(NEW.reason, ''), NEW.created_by,
     v_settlement_id);

  UPDATE public.daily_cash_settlements
  SET owner_injection = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.cash_movements
    WHERE settlement_id = v_settlement_id
      AND movement_type = 'owner_injection'
      AND is_reversed = FALSE
  ), updated_date = NOW()
  WHERE id = v_settlement_id;

  -- Update injection with settlement reference
  UPDATE public.owner_cash_injections
  SET settlement_id = v_settlement_id
  WHERE id = NEW.id;

  PERFORM public.recompute_settlement(v_settlement_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_injection_cash ON public.owner_cash_injections;
CREATE TRIGGER trg_owner_injection_cash
  AFTER INSERT ON public.owner_cash_injections
  FOR EACH ROW EXECUTE FUNCTION public.trg_owner_injection_cash_post();

-- ── 16. TRIGGER: AUTO-CREATE SHORTAGE RECORD ON SETTLEMENT SUBMIT ────────────
CREATE OR REPLACE FUNCTION public.trg_settlement_shortage_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shortage_id UUID;
BEGIN
  -- Only trigger when status changes to Submitted
  IF NEW.status != 'Submitted' OR OLD.status = 'Submitted' THEN
    RETURN NEW;
  END IF;

  -- If there is a discrepancy, create a shortage/overage record
  IF NEW.difference != 0 THEN
    INSERT INTO public.cash_shortages
      (date, branch, restaurant_id, created_by, settlement_id,
       expected_amount, actual_amount, shortage_amount, overage_amount,
       type, status, reported_by)
    VALUES
      (NEW.date, NEW.branch, NEW.restaurant_id, NEW.created_by, NEW.id,
       NEW.expected_closing_cash, NEW.cash_counted,
       CASE WHEN NEW.difference < 0 THEN ABS(NEW.difference) ELSE 0 END,
       CASE WHEN NEW.difference > 0 THEN NEW.difference ELSE 0 END,
       CASE WHEN NEW.difference < 0 THEN 'Shortage' ELSE 'Overage' END,
       'Pending', NEW.manager)
    RETURNING id INTO v_shortage_id;

    -- Link shortage back to settlement
    UPDATE public.daily_cash_settlements
    SET shortage_record_id = v_shortage_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settlement_shortage ON public.daily_cash_settlements;
CREATE TRIGGER trg_settlement_shortage
  AFTER UPDATE OF status ON public.daily_cash_settlements
  FOR EACH ROW EXECUTE FUNCTION public.trg_settlement_shortage_check();

-- ── 17. GRANT EXECUTE ON FUNCTIONS ──────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.recompute_settlement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_settlement(DATE, TEXT, TEXT, UUID) TO authenticated;
