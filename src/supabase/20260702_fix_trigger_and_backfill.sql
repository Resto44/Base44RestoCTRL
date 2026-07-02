-- ============================================================
-- FIX: Trigger function movement_type values + Corrected Backfill
-- Date: 2026-07-02
-- Description:
--   1. Fixes trg_auto_cash_movement_and_recalculate to use
--      'cash_purchase' and 'cash_expense' (singular) to match
--      the corrected CHECK constraint.
--   2. Replaces backfill_cash_register_data with a version
--      that uses the real production column names.
-- ============================================================

-- ── STEP 1: Fix the trigger function (movement_type singular forms) ───────────
CREATE OR REPLACE FUNCTION public.trg_auto_cash_movement_and_recalculate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settlement_id    UUID;
  v_movement_type    TEXT;
  v_direction        TEXT;
  v_amount           NUMERIC;
  v_source_module    TEXT;
  v_source_record_id TEXT;
  v_description      TEXT;
  v_created_by       TEXT;
  v_restaurant_id    UUID;
  v_branch           TEXT;
  v_date             DATE;
  v_old_amount       NUMERIC DEFAULT 0;
BEGIN
  -- Map table → fields using real production column names
  IF TG_TABLE_NAME = 'daily_sales' THEN
    v_date             := NEW.date;
    v_branch           := NEW.branch;
    v_created_by       := NEW.created_by;
    v_restaurant_id    := CASE WHEN NEW.restaurant_id ~ '^[0-9a-fA-F-]{36}$'
                               THEN NEW.restaurant_id::UUID ELSE NULL END;
    v_source_module    := 'Sales';
    v_source_record_id := NEW.id::TEXT;
    v_description      := 'Cash Sale';
    v_movement_type    := 'cash_sale';
    v_direction        := 'in';
    v_amount           := COALESCE(NEW.restaurant_cash, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.restaurant_cash, 0); END IF;

  ELSIF TG_TABLE_NAME = 'purchases' THEN
    v_date             := NEW.date;
    v_branch           := NEW.branch;
    v_created_by       := NEW.created_by;
    v_restaurant_id    := NEW.restaurant_id;
    v_source_module    := 'Purchases';
    v_source_record_id := NEW.id::TEXT;
    v_description      := 'Cash Purchase';
    v_movement_type    := 'cash_purchase';          -- FIXED: was 'cash_purchases'
    v_direction        := 'out';
    v_amount           := COALESCE(NEW.qty * NEW.used_price, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.qty * OLD.used_price, 0); END IF;

  ELSIF TG_TABLE_NAME = 'expenses' THEN
    v_date             := NEW.date;
    v_branch           := NEW.branch_key;           -- production uses branch_key
    v_created_by       := NEW.created_by;
    v_restaurant_id    := NEW.restaurant_id;
    v_source_module    := 'Expenses';
    v_source_record_id := NEW.id::TEXT;
    v_description      := 'Cash Expense';
    v_movement_type    := 'cash_expense';           -- FIXED: was 'cash_expenses'
    v_direction        := 'out';
    v_amount           := COALESCE(NEW.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); END IF;

  ELSIF TG_TABLE_NAME = 'customer_collections' THEN
    IF NEW.payment_method <> 'Cash' THEN RETURN NEW; END IF;
    v_date             := NEW.date;
    v_branch           := NEW.branch;
    v_created_by       := NEW.created_by;
    v_restaurant_id    := NEW.restaurant_id;
    v_source_module    := 'CustomerPayments';
    v_source_record_id := NEW.id::TEXT;
    v_description      := 'Customer Debt Collection';
    v_movement_type    := 'customer_debt_collection';
    v_direction        := 'in';
    v_amount           := COALESCE(NEW.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); END IF;

  ELSIF TG_TABLE_NAME = 'supplier_payments' THEN
    IF NEW.payment_method <> 'Cash' THEN RETURN NEW; END IF;
    v_date             := NEW.date;
    v_branch           := NEW.branch;
    v_created_by       := NEW.created_by;
    v_restaurant_id    := NEW.restaurant_id;
    v_source_module    := 'SupplierPayments';
    v_source_record_id := NEW.id::TEXT;
    v_description      := 'Supplier Payment';
    v_movement_type    := 'supplier_payment';
    v_direction        := 'out';
    v_amount           := COALESCE(NEW.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); END IF;

  ELSIF TG_TABLE_NAME = 'wallet_transactions' THEN
    IF NEW.payment_method <> 'Cash' THEN RETURN NEW; END IF;
    v_date             := NEW.transaction_date;
    v_branch           := NEW.branch;
    v_created_by       := NEW.created_by;
    v_restaurant_id    := NEW.restaurant_id;
    v_source_module    := 'Treasury';
    v_source_record_id := NEW.id::TEXT;
    IF NEW.transaction_type = 'deposit' THEN
      v_description   := 'Cash Deposit';
      v_movement_type := 'cash_deposit';
      v_direction     := 'in';
    ELSIF NEW.transaction_type = 'withdrawal' THEN
      v_description   := 'Cash Withdrawal';
      v_movement_type := 'cash_withdrawal';
      v_direction     := 'out';
    ELSE
      RETURN NEW;
    END IF;
    v_amount := COALESCE(NEW.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); END IF;

  ELSIF TG_TABLE_NAME = 'owner_cash_injections' THEN
    v_date             := NEW.date;
    v_branch           := NEW.branch;
    v_created_by       := NEW.created_by;
    v_restaurant_id    := NEW.restaurant_id;
    v_source_module    := 'OwnerCashInjection';
    v_source_record_id := NEW.id::TEXT;
    v_description      := 'Owner Cash Injection';
    v_movement_type    := 'owner_injection';
    v_direction        := 'in';
    v_amount           := COALESCE(NEW.amount, 0);
    IF TG_OP = 'UPDATE' THEN v_old_amount := COALESCE(OLD.amount, 0); END IF;

  ELSE
    RETURN NEW;
  END IF;

  IF v_amount = 0 AND v_old_amount = 0 AND TG_OP <> 'DELETE' THEN
    RETURN NEW;
  END IF;

  v_settlement_id := public.get_or_create_settlement(
    v_date, v_branch, v_created_by, v_restaurant_id
  );

  -- Reverse old movement on UPDATE or DELETE
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND v_old_amount > 0 THEN
    UPDATE public.cash_movements
      SET is_reversed = TRUE, updated_date = NOW()
    WHERE source_module = v_source_module
      AND source_record_id = OLD.id::TEXT
      AND is_reversed = FALSE;

    EXECUTE FORMAT(
      'UPDATE public.daily_cash_settlements SET %I = GREATEST(%I - %L, 0) WHERE id = %L',
      v_movement_type, v_movement_type, v_old_amount, v_settlement_id
    );
  END IF;

  -- Post new movement on INSERT or UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND v_amount > 0 THEN
    INSERT INTO public.cash_movements (
      date, branch, restaurant_id, created_by, direction, amount, movement_type,
      source_module, source_record_id, description, posted_by, posted_by_name, settlement_id
    ) VALUES (
      v_date, v_branch, v_restaurant_id, v_created_by,
      v_direction, v_amount, v_movement_type,
      v_source_module, v_source_record_id, v_description,
      v_created_by, v_created_by, v_settlement_id
    );

    EXECUTE FORMAT(
      'UPDATE public.daily_cash_settlements SET %I = %I + %L WHERE id = %L',
      v_movement_type, v_movement_type, v_amount, v_settlement_id
    );
  END IF;

  PERFORM public.recompute_settlement(v_settlement_id);
  RETURN NEW;
END;
$$;

-- ── STEP 2: Corrected backfill function using real production column names ─────
CREATE OR REPLACE FUNCTION public.backfill_cash_register_data(
  start_date DATE,
  end_date   DATE
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cur_date        DATE;
  r               RECORD;
  r_sale          RECORD;
  r_purchase      RECORD;
  r_expense       RECORD;
  r_cust          RECORD;
  r_supp          RECORD;
  r_wallet        RECORD;
  r_injection     RECORD;
  v_settlement_id UUID;
BEGIN
  cur_date := start_date;

  WHILE cur_date <= end_date LOOP
    RAISE NOTICE 'Backfill processing date: %', cur_date;

    -- Collect distinct (branch, created_by, restaurant_id) combos active on this date
    FOR r IN
      SELECT DISTINCT branch, created_by, restaurant_id FROM (
        SELECT branch, created_by, restaurant_id FROM public.daily_sales
          WHERE date = cur_date AND restaurant_cash > 0
        UNION ALL
        SELECT branch, created_by, restaurant_id FROM public.purchases
          WHERE date = cur_date
        UNION ALL
        SELECT branch_key AS branch, created_by, restaurant_id FROM public.expenses
          WHERE date = cur_date
        UNION ALL
        SELECT branch, created_by, restaurant_id FROM public.customer_collections
          WHERE date = cur_date AND payment_method = 'Cash'
        UNION ALL
        SELECT branch, created_by, restaurant_id FROM public.supplier_payments
          WHERE date = cur_date AND payment_method = 'Cash'
        UNION ALL
        SELECT branch, created_by, restaurant_id FROM public.wallet_transactions
          WHERE transaction_date = cur_date AND payment_method = 'Cash'
        UNION ALL
        SELECT branch, created_by, restaurant_id FROM public.owner_cash_injections
          WHERE date = cur_date
      ) AS activity
    LOOP
      v_settlement_id := public.get_or_create_settlement(
        cur_date, r.branch, r.created_by, r.restaurant_id
      );

      -- Cash Sales
      FOR r_sale IN
        SELECT * FROM public.daily_sales
        WHERE date = cur_date
          AND branch = r.branch
          AND created_by IS NOT DISTINCT FROM r.created_by
          AND restaurant_cash > 0
      LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount,
          movement_type, source_module, source_record_id, description,
          posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_sale.date, r_sale.branch, r_sale.restaurant_id, r_sale.created_by,
          'in', r_sale.restaurant_cash, 'cash_sale', 'Sales',
          r_sale.id::TEXT, 'Cash Sale (backfill)',
          r_sale.created_by, r_sale.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;

        UPDATE public.daily_cash_settlements
          SET cash_sales = cash_sales + r_sale.restaurant_cash
        WHERE id = v_settlement_id;
      END LOOP;

      -- Cash Purchases (amount = qty * used_price, all purchases treated as cash)
      FOR r_purchase IN
        SELECT * FROM public.purchases
        WHERE date = cur_date
          AND branch = r.branch
          AND created_by IS NOT DISTINCT FROM r.created_by
          AND (qty * used_price) > 0
      LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount,
          movement_type, source_module, source_record_id, description,
          posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_purchase.date, r_purchase.branch, r_purchase.restaurant_id, r_purchase.created_by,
          'out', (r_purchase.qty * r_purchase.used_price), 'cash_purchase', 'Purchases',
          r_purchase.id::TEXT, 'Cash Purchase (backfill)',
          r_purchase.created_by, r_purchase.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;

        UPDATE public.daily_cash_settlements
          SET cash_purchases = cash_purchases + (r_purchase.qty * r_purchase.used_price)
        WHERE id = v_settlement_id;
      END LOOP;

      -- Cash Expenses (expenses table uses branch_key, no payment_method — all treated as cash)
      FOR r_expense IN
        SELECT * FROM public.expenses
        WHERE date = cur_date
          AND branch_key = r.branch
          AND created_by IS NOT DISTINCT FROM r.created_by
          AND amount > 0
      LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount,
          movement_type, source_module, source_record_id, description,
          posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_expense.date, r_expense.branch_key, r_expense.restaurant_id, r_expense.created_by,
          'out', r_expense.amount, 'cash_expense', 'Expenses',
          r_expense.id::TEXT, 'Cash Expense (backfill)',
          r_expense.created_by, r_expense.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;

        UPDATE public.daily_cash_settlements
          SET cash_expenses = cash_expenses + r_expense.amount
        WHERE id = v_settlement_id;
      END LOOP;

      -- Customer Collections (cash only)
      FOR r_cust IN
        SELECT * FROM public.customer_collections
        WHERE date = cur_date
          AND branch = r.branch
          AND created_by IS NOT DISTINCT FROM r.created_by
          AND payment_method = 'Cash'
          AND amount > 0
      LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount,
          movement_type, source_module, source_record_id, description,
          posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_cust.date, r_cust.branch, r_cust.restaurant_id, r_cust.created_by,
          'in', r_cust.amount, 'customer_debt_collection', 'CustomerPayments',
          r_cust.id::TEXT, 'Customer Debt Collection (backfill)',
          r_cust.created_by, r_cust.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;

        UPDATE public.daily_cash_settlements
          SET customer_debt_collection = customer_debt_collection + r_cust.amount
        WHERE id = v_settlement_id;
      END LOOP;

      -- Supplier Payments (cash only)
      FOR r_supp IN
        SELECT * FROM public.supplier_payments
        WHERE date = cur_date
          AND branch = r.branch
          AND created_by IS NOT DISTINCT FROM r.created_by
          AND payment_method = 'Cash'
          AND amount > 0
      LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount,
          movement_type, source_module, source_record_id, description,
          posted_by, posted_by_name, settlement_id
        ) ON CONFLICT DO NOTHING
        VALUES (
          r_supp.date, r_supp.branch, r_supp.restaurant_id, r_supp.created_by,
          'out', r_supp.amount, 'supplier_payment', 'SupplierPayments',
          r_supp.id::TEXT, 'Supplier Payment (backfill)',
          r_supp.created_by, r_supp.created_by, v_settlement_id
        );

        UPDATE public.daily_cash_settlements
          SET supplier_payments = supplier_payments + r_supp.amount
        WHERE id = v_settlement_id;
      END LOOP;

      -- Wallet Transactions (cash deposits/withdrawals)
      FOR r_wallet IN
        SELECT * FROM public.wallet_transactions
        WHERE transaction_date = cur_date
          AND branch = r.branch
          AND created_by IS NOT DISTINCT FROM r.created_by
          AND payment_method = 'Cash'
          AND amount > 0
      LOOP
        IF r_wallet.transaction_type = 'deposit' THEN
          INSERT INTO public.cash_movements (
            date, branch, restaurant_id, created_by, direction, amount,
            movement_type, source_module, source_record_id, description,
            posted_by, posted_by_name, settlement_id
          ) VALUES (
            r_wallet.transaction_date, r_wallet.branch, r_wallet.restaurant_id, r_wallet.created_by,
            'in', r_wallet.amount, 'cash_deposit', 'Treasury',
            r_wallet.id::TEXT, 'Cash Deposit (backfill)',
            r_wallet.created_by, r_wallet.created_by, v_settlement_id
          ) ON CONFLICT DO NOTHING;

          UPDATE public.daily_cash_settlements
            SET cash_transfer_in = cash_transfer_in + r_wallet.amount
          WHERE id = v_settlement_id;

        ELSIF r_wallet.transaction_type = 'withdrawal' THEN
          INSERT INTO public.cash_movements (
            date, branch, restaurant_id, created_by, direction, amount,
            movement_type, source_module, source_record_id, description,
            posted_by, posted_by_name, settlement_id
          ) VALUES (
            r_wallet.transaction_date, r_wallet.branch, r_wallet.restaurant_id, r_wallet.created_by,
            'out', r_wallet.amount, 'cash_withdrawal', 'Treasury',
            r_wallet.id::TEXT, 'Cash Withdrawal (backfill)',
            r_wallet.created_by, r_wallet.created_by, v_settlement_id
          ) ON CONFLICT DO NOTHING;

          UPDATE public.daily_cash_settlements
            SET cash_transfer_out = cash_transfer_out + r_wallet.amount
          WHERE id = v_settlement_id;
        END IF;
      END LOOP;

      -- Owner Cash Injections
      FOR r_injection IN
        SELECT * FROM public.owner_cash_injections
        WHERE date = cur_date
          AND branch = r.branch
          AND created_by IS NOT DISTINCT FROM r.created_by
          AND amount > 0
      LOOP
        INSERT INTO public.cash_movements (
          date, branch, restaurant_id, created_by, direction, amount,
          movement_type, source_module, source_record_id, description,
          posted_by, posted_by_name, settlement_id
        ) VALUES (
          r_injection.date, r_injection.branch, r_injection.restaurant_id, r_injection.created_by,
          'in', r_injection.amount, 'owner_injection', 'OwnerCashInjection',
          r_injection.id::TEXT, 'Owner Cash Injection (backfill)',
          r_injection.created_by, r_injection.created_by, v_settlement_id
        ) ON CONFLICT DO NOTHING;

        UPDATE public.daily_cash_settlements
          SET owner_injection = owner_injection + r_injection.amount
        WHERE id = v_settlement_id;
      END LOOP;

      -- Recompute settlement totals for this branch/date
      PERFORM public.recompute_settlement(v_settlement_id);

    END LOOP; -- end branch loop

    cur_date := cur_date + INTERVAL '1 day';
  END LOOP; -- end date loop
END;
$$;
